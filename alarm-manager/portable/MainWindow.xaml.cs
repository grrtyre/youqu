using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Navigation;
using AlarmManager.Portable.Core;
using AlarmManager.Portable.Models;
using Microsoft.Win32;

namespace AlarmManager.Portable
{
    /// <summary>
    /// 主窗口 - 闹钟列表 + 编辑/设置视图切换
    /// 失焦自动隐藏（仿输入法候选框）
    /// </summary>
    public partial class MainWindow : Window
    {
        private Alarm? _editingAlarm = null;
        private bool _isNew = true;

        public MainWindow()
        {
            InitializeComponent();
            Loaded += (s, e) =>
            {
                // 窗口位置：屏幕右下角，距托盘近
                PositionNearSystemTray();
                RefreshList();
                LoadSettings();
            };
        }

        /// <summary>定位窗口到屏幕右下角（贴近系统托盘）</summary>
        private void PositionNearSystemTray()
        {
            try
            {
                var workArea = SystemParameters.WorkArea;
                Left = workArea.Right - Width - 14;
                Top = workArea.Bottom - Height - 14;
            }
            catch { }
        }

        /// <summary>标题栏拖动</summary>
        protected override void OnMouseLeftButtonDown(MouseButtonEventArgs e)
        {
            base.OnMouseLeftButtonDown(e);
            if (e.ButtonState == MouseButtonState.Pressed)
            {
                try { DragMove(); } catch { }
            }
        }

        /// <summary>失焦自动隐藏（输入法式体验）</summary>
        private void Window_Deactivated(object sender, EventArgs e)
        {
            // 演示模式跳过自动隐藏（用于截图测试）
            if (App.IsDemoMode) return;
            // 延迟 200ms 隐藏，避免与子菜单点击冲突
            var timer = new System.Windows.Threading.DispatcherTimer { Interval = TimeSpan.FromMilliseconds(200) };
            timer.Tick += (s, e2) =>
            {
                if (!IsFocused && !IsActive && EditPanel.Visibility != Visibility.Visible && SettingsPanel.Visibility != Visibility.Visible)
                {
                    Hide();
                }
                ((System.Windows.Threading.DispatcherTimer)s).Stop();
            };
            timer.Start();
        }

        /// <summary>刷新列表 UI</summary>
        public void RefreshList()
        {
            AlarmListPanel.Children.Clear();
            var alarms = App.Data.Alarms;
            int enabledCount = alarms.Count(a => a.Enabled);

            // 更新统计
            StatsText.Text = alarms.Count + " 个闹钟 · " + enabledCount + " 个启用";

            // 下一个闹钟文本
            var nextAlarm = alarms
                .Where(a => a.Enabled && a.NextTrigger != null)
                .OrderBy(a => a.NextTrigger)
                .FirstOrDefault();
            NextAlarmText.Text = nextAlarm != null
                ? "下一次：" + nextAlarm.Label + " · " + AlarmEngine.DescribeNextTime(nextAlarm.NextTrigger) + " · " + AlarmEngine.DescribeCountdown(nextAlarm.NextTrigger, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds())
                : "无启用的闹钟";

            // 空状态
            EmptyState.Visibility = alarms.Count == 0 ? Visibility.Visible : Visibility.Collapsed;

            foreach (var a in alarms)
            {
                AlarmListPanel.Children.Add(CreateAlarmCard(a));
            }
        }

        /// <summary>创建闹钟卡片</summary>
        private UIElement CreateAlarmCard(Alarm a)
        {
            Border card = new Border();
            card.Style = (Style)FindResource("ListItemStyle");
            card.Tag = a.Id;

            Grid grid = new Grid();
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            // 左：时间 + 标签
            StackPanel left = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
            left.MouseLeftButtonUp += (s, e) => EditAlarm(a);
            left.Cursor = Cursors.Hand;

            TextBlock timeText = new TextBlock
            {
                Text = AlarmEngine.FormatTime(a.Hour, a.Minute),
                FontFamily = (FontFamily)FindResource("AppleFont"),
                FontSize = 30,
                FontWeight = FontWeights.Light,
                Foreground = a.Enabled
                    ? (Brush)FindResource("TextPrimaryBrush")
                    : (Brush)FindResource("TextTertiaryBrush"),
            };
            left.Children.Add(timeText);

            TextBlock labelLine = new TextBlock
            {
                Margin = new Thickness(0, 1, 0, 0),
                FontFamily = (FontFamily)FindResource("AppleFont"),
                FontSize = 12,
            };
            var labelRun = new Run(a.Label);
            labelRun.Foreground = (Brush)FindResource("TextSecondaryBrush");
            var sepRun = new Run(" · ");
            sepRun.Foreground = (Brush)FindResource("TextTertiaryBrush");
            var repeatRun = new Run(AlarmEngine.DescribeRepeat(a.Repeat));
            repeatRun.Foreground = (Brush)FindResource("TextTertiaryBrush");
            labelLine.Inlines.Add(labelRun);
            labelLine.Inlines.Add(sepRun);
            labelLine.Inlines.Add(repeatRun);
            left.Children.Add(labelLine);

            // 下一行：下次触发倒计时
            if (a.Enabled && a.NextTrigger != null)
            {
                TextBlock nextLine = new TextBlock
                {
                    Text = "下次 " + AlarmEngine.DescribeNextTime(a.NextTrigger) + " · " + AlarmEngine.DescribeCountdown(a.NextTrigger, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()),
                    Margin = new Thickness(0, 4, 0, 0),
                    FontFamily = (FontFamily)FindResource("AppleFont"),
                    FontSize = 11,
                    Foreground = (Brush)FindResource("TextTertiaryBrush"),
                };
                left.Children.Add(nextLine);
            }
            else if (!a.Enabled)
            {
                TextBlock off = new TextBlock
                {
                    Text = "已停用",
                    Margin = new Thickness(0, 4, 0, 0),
                    FontFamily = (FontFamily)FindResource("AppleFont"),
                    FontSize = 11,
                    Foreground = (Brush)FindResource("TextTertiaryBrush"),
                };
                left.Children.Add(off);
            }
            Grid.SetColumn(left, 0);
            grid.Children.Add(left);

            // 切换开关
            CheckBox toggle = new CheckBox
            {
                Style = (Style)FindResource("ToggleSwitch"),
                IsChecked = a.Enabled,
                VerticalAlignment = VerticalAlignment.Center,
                Cursor = Cursors.Hand,
            };
            toggle.Checked += (s, e) =>
            {
                a.Enabled = true;
                a.NextTrigger = AlarmEngine.NextTrigger(a);
                Store.Save(App.Data, App.DataFile);
                RefreshList();
            };
            toggle.Unchecked += (s, e) =>
            {
                a.Enabled = false;
                a.NextTrigger = null;
                Store.Save(App.Data, App.DataFile);
                RefreshList();
            };
            Grid.SetColumn(toggle, 1);
            grid.Children.Add(toggle);

            // 编辑按钮
            Button editBtn = new Button
            {
                Style = (Style)FindResource("IconButton"),
                Content = "✎",
                FontSize = 16,
                Width = 34, Height = 34,
                ToolTip = "编辑",
                Cursor = Cursors.Hand,
                Margin = new Thickness(8, 0, 0, 0),
            };
            editBtn.Click += (s, e) => EditAlarm(a);
            Grid.SetColumn(editBtn, 2);
            grid.Children.Add(editBtn);

            // 删除按钮
            Button delBtn = new Button
            {
                Style = (Style)FindResource("IconButton"),
                Content = "🗑",
                FontSize = 15,
                Width = 34, Height = 34,
                ToolTip = "删除",
                Cursor = Cursors.Hand,
                Margin = new Thickness(2, 0, 0, 0),
                Foreground = (Brush)FindResource("TextSecondaryBrush"),
            };
            delBtn.Click += (s, e) => DeleteAlarm(a);
            Grid.SetColumn(delBtn, 3);
            grid.Children.Add(delBtn);

            card.Child = grid;
            return card;
        }

        private void EditAlarm(Alarm a)
        {
            _editingAlarm = a;
            _isNew = false;
            EditTitle.Text = "编辑闹钟";
            BtnDeleteEdit.Visibility = Visibility.Visible;
            FillEditForm(a);
            ListPanel.Visibility = Visibility.Collapsed;
            EditPanel.Visibility = Visibility.Visible;
        }

        private void FillEditForm(Alarm a)
        {
            EditHour.Text = a.Hour.ToString("D2");
            EditMinute.Text = a.Minute.ToString("D2");
            EditLabel.Text = a.Label;
            EditSnooze.Text = a.SnoozeMinutes.ToString();
            EditMaxSnooze.Text = a.MaxSnoozeCount.ToString();
            EditVolume.Value = (int)(a.Volume * 100);
            EditEnabled.IsChecked = a.Enabled;

            // 重复模式
            string repType = a.Repeat?.Type ?? "once";
            for (int i = 0; i < EditRepeat.Items.Count; i++)
            {
                if (EditRepeat.Items[i] is ComboBoxItem item && (string)item.Tag == repType)
                {
                    EditRepeat.SelectedIndex = i;
                    break;
                }
            }
            // 自定义周几
            if (a.Repeat?.Weekdays != null)
            {
                var wdArr = a.Repeat.Weekdays;
                WdMon.IsChecked = wdArr.Contains(1);
                WdTue.IsChecked = wdArr.Contains(2);
                WdWed.IsChecked = wdArr.Contains(3);
                WdThu.IsChecked = wdArr.Contains(4);
                WdFri.IsChecked = wdArr.Contains(5);
                WdSat.IsChecked = wdArr.Contains(6);
                WdSun.IsChecked = wdArr.Contains(0);
            }
            // 农历
            if (a.Repeat?.LunarMonth > 0)
            {
                for (int i = 0; i < LunarMonthCombo.Items.Count; i++)
                {
                    if (LunarMonthCombo.Items[i] is ComboBoxItem mi && (string)mi.Tag == a.Repeat.LunarMonth.ToString())
                    {
                        LunarMonthCombo.SelectedIndex = i; break;
                    }
                }
            }
            LunarDayCombo.Items.Clear();
            for (int d = 1; d <= 30; d++)
            {
                var item = new ComboBoxItem { Content = Lunar.DayName(d), Tag = d.ToString() };
                if (a.Repeat?.LunarDay == d) item.IsSelected = true;
                LunarDayCombo.Items.Add(item);
            }
            if (a.Repeat?.LunarDay > 0)
            {
                for (int i = 0; i < LunarDayCombo.Items.Count; i++)
                {
                    if (LunarDayCombo.Items[i] is ComboBoxItem item && (string)item.Tag == a.Repeat.LunarDay.ToString())
                    {
                        LunarDayCombo.SelectedIndex = i; break;
                    }
                }
            }
            IsLeapCheck.IsChecked = a.Repeat?.IsLeap ?? false;

            // 铃声
            for (int i = 0; i < EditSound.Items.Count; i++)
            {
                if (EditSound.Items[i] is ComboBoxItem item && (string)item.Tag == a.Sound)
                {
                    EditSound.SelectedIndex = i; break;
                }
            }

            UpdateEditPreview();
        }

        private void EditRepeat_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (WeekdaysPanel == null || LunarPanel == null) return;
            if (EditRepeat.SelectedItem is ComboBoxItem item)
            {
                string tag = (string)item.Tag;
                WeekdaysPanel.Visibility = tag == "custom" ? Visibility.Visible : Visibility.Collapsed;
                LunarPanel.Visibility = (tag == "lunar-annual" || tag == "lunar-once") ? Visibility.Visible : Visibility.Collapsed;
                UpdateEditPreview();
            }
        }

        private void UpdateEditPreview()
        {
            if (EditRepeatPreview == null) return;
            var rep = BuildRepeatFromForm();
            EditRepeatPreview.Text = AlarmEngine.DescribeRepeat(rep);
        }

        private RepeatRule BuildRepeatFromForm()
        {
            if (EditRepeat.SelectedItem is ComboBoxItem item)
            {
                string tag = (string)item.Tag;
                var rep = new RepeatRule { Type = tag };
                if (tag == "custom")
                {
                    var list = new List<int>();
                    if (WdSun.IsChecked == true) list.Add(0);
                    if (WdMon.IsChecked == true) list.Add(1);
                    if (WdTue.IsChecked == true) list.Add(2);
                    if (WdWed.IsChecked == true) list.Add(3);
                    if (WdThu.IsChecked == true) list.Add(4);
                    if (WdFri.IsChecked == true) list.Add(5);
                    if (WdSat.IsChecked == true) list.Add(6);
                    rep.Weekdays = list.ToArray();
                }
                if (tag == "lunar-annual" || tag == "lunar-once")
                {
                    if (LunarMonthCombo.SelectedItem is ComboBoxItem mi)
                        rep.LunarMonth = int.Parse((string)mi.Tag);
                    if (LunarDayCombo.SelectedItem is ComboBoxItem di)
                        rep.LunarDay = int.Parse((string)di.Tag);
                    rep.IsLeap = IsLeapCheck.IsChecked == true;
                }
                return rep;
            }
            return new RepeatRule { Type = "once" };
        }

        private void BtnSaveEdit_Click(object sender, RoutedEventArgs e)
        {
            // 验证
            if (!int.TryParse(EditHour.Text, out int h) || h < 0 || h > 23)
            {
                MessageBox.Show("小时必须是 0-23 的数字", "提示", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            if (!int.TryParse(EditMinute.Text, out int m) || m < 0 || m > 59)
            {
                MessageBox.Show("分钟必须是 0-59 的数字", "提示", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            if (!int.TryParse(EditSnooze.Text, out int snooze) || snooze < 1 || snooze > 60)
            {
                MessageBox.Show("贪睡分钟必须是 1-60 的数字", "提示", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            if (!int.TryParse(EditMaxSnooze.Text, out int maxSnooze) || maxSnooze < 0 || maxSnooze > 10)
            {
                MessageBox.Show("最大贪睡次数必须是 0-10 的数字", "提示", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            string sound = "chime";
            if (EditSound.SelectedItem is ComboBoxItem si) sound = (string)si.Tag;

            Alarm a;
            if (_isNew)
            {
                a = new Alarm();
                App.Data.Alarms.Add(a);
            }
            else
            {
                a = _editingAlarm!;
            }
            a.Label = string.IsNullOrEmpty(EditLabel.Text) ? "闹钟" : EditLabel.Text;
            a.Hour = h;
            a.Minute = m;
            a.Repeat = BuildRepeatFromForm();
            a.Sound = sound;
            a.SnoozeMinutes = snooze;
            a.MaxSnoozeCount = maxSnooze;
            a.Volume = EditVolume.Value / 100.0;
            a.Enabled = EditEnabled.IsChecked == true;
            a.NextTrigger = a.Enabled ? AlarmEngine.NextTrigger(a) : null;

            Store.Save(App.Data, App.DataFile);
            BackToList();
            RefreshList();
        }

        private void BtnCancelEdit_Click(object sender, RoutedEventArgs e)
        {
            BackToList();
        }

        private void BtnDeleteEdit_Click(object sender, RoutedEventArgs e)
        {
            if (_isNew) { BackToList(); return; }
            var r = MessageBox.Show($"确认删除闹钟「{_editingAlarm?.Label}」？", "确认删除",
                MessageBoxButton.YesNo, MessageBoxImage.Question);
            if (r == MessageBoxResult.Yes)
            {
                App.Data.Alarms.Remove(_editingAlarm);
                Store.Save(App.Data, App.DataFile);
                BackToList();
                RefreshList();
            }
        }

        private void DeleteAlarm(Alarm a)
        {
            var r = MessageBox.Show($"确认删除闹钟「{a.Label}」？", "确认删除",
                MessageBoxButton.YesNo, MessageBoxImage.Question);
            if (r == MessageBoxResult.Yes)
            {
                App.Data.Alarms.Remove(a);
                Store.Save(App.Data, App.DataFile);
                RefreshList();
            }
        }

        private void BackToList()
        {
            ListPanel.Visibility = Visibility.Visible;
            EditPanel.Visibility = Visibility.Collapsed;
            _editingAlarm = null;
            _isNew = false;
        }

        private void BtnAdd_Click(object sender, RoutedEventArgs e)
        {
            _editingAlarm = null;
            _isNew = true;
            EditTitle.Text = "新建闹钟";
            BtnDeleteEdit.Visibility = Visibility.Collapsed;
            // 默认值
            var a = AlarmEngine.CreateAlarm("闹钟", 7, 0);
            FillEditForm(a);
            ListPanel.Visibility = Visibility.Collapsed;
            EditPanel.Visibility = Visibility.Visible;
        }

        private void BtnClose_Click(object sender, RoutedEventArgs e)
        {
            Hide();
        }

        private void BtnExit_Click(object sender, RoutedEventArgs e)
        {
            var r = MessageBox.Show("确认退出闹钟管家？后台闹钟将不再触发。", "退出确认",
                MessageBoxButton.YesNo, MessageBoxImage.Question);
            if (r == MessageBoxResult.Yes)
            {
                ((App)App.Current).ExitApp();
            }
        }

        // ========= 设置面板 =========
        private void LoadSettings()
        {
            var s = App.Data.Settings;
            SetFadeIn.IsChecked = s.VolumeFadeIn;
            SetNotify.IsChecked = s.NotificationEnabled;
            SetFront.IsChecked = s.BringToFront;
        }

        private void BtnSettings_Click(object sender, RoutedEventArgs e)
        {
            LoadSettings();
            ListPanel.Visibility = Visibility.Collapsed;
            SettingsPanel.Visibility = Visibility.Visible;
        }

        private void BtnCloseSettings_Click(object sender, RoutedEventArgs e)
        {
            // 保存设置
            var s = App.Data.Settings;
            s.VolumeFadeIn = SetFadeIn.IsChecked == true;
            s.NotificationEnabled = SetNotify.IsChecked == true;
            s.BringToFront = SetFront.IsChecked == true;
            Store.Save(App.Data, App.DataFile);
            SettingsPanel.Visibility = Visibility.Collapsed;
            ListPanel.Visibility = Visibility.Visible;
        }

        private void BtnExport_Click(object sender, RoutedEventArgs e)
        {
            var dlg = new SaveFileDialog
            {
                Filter = "JSON 文件|*.json",
                FileName = "alarms-export-" + DateTime.Now.ToString("yyyyMMdd") + ".json"
            };
            if (dlg.ShowDialog() == true)
            {
                File.WriteAllText(dlg.FileName, Store.ExportJson(App.Data), new System.Text.UTF8Encoding(false));
                MessageBox.Show("导出成功", "完成", MessageBoxButton.OK, MessageBoxImage.Information);
            }
        }

        private void BtnImport_Click(object sender, RoutedEventArgs e)
        {
            var dlg = new OpenFileDialog { Filter = "JSON 文件|*.json" };
            if (dlg.ShowDialog() == true)
            {
                try
                {
                    var text = File.ReadAllText(dlg.FileName, System.Text.Encoding.UTF8);
                    var imported = Store.ImportJson(text);
                    if (MessageBox.Show($"将导入 {imported.Alarms.Count} 个闹钟、{imported.Logs.Count} 条历史。是否覆盖当前数据？",
                        "导入确认", MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes)
                    {
                        App.Data = imported;
                        Store.Save(App.Data, App.DataFile);
                        RefreshList();
                        MessageBox.Show("导入成功", "完成", MessageBoxButton.OK, MessageBoxImage.Information);
                    }
                }
                catch (Exception ex)
                {
                    MessageBox.Show("导入失败：" + ex.Message, "错误", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
        }

        private void BtnClearLogs_Click(object sender, RoutedEventArgs e)
        {
            if (MessageBox.Show("确认清空所有触发历史？", "确认", MessageBoxButton.YesNo) == MessageBoxResult.Yes)
            {
                App.Data.Logs.Clear();
                Store.Save(App.Data, App.DataFile);
                MessageBox.Show("已清空", "完成", MessageBoxButton.OK, MessageBoxImage.Information);
            }
        }

        private void Link_RequestNavigate(object sender, RequestNavigateEventArgs e)
        {
            try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(e.Uri.AbsoluteUri) { UseShellExecute = true }); }
            catch { }
            e.Handled = true;
        }
    }
}
